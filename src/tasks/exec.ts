import { ListrTask, ListrRendererFactory, createWritable } from 'listr2'
import { Context } from '../types.js'
import chalk from 'chalk'
import spawn from 'cross-spawn'
import { updateLogContext } from '../lib/logger.js'
import { startPolling, startSSEListener } from '../lib/utils.js'
import fs from 'fs'
import path from 'path'

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Executing '${ctx.args.execCommand?.join(' ')}'`,
        task: async (ctx, task): Promise<void> => {

            if (ctx.options.fetchResults) {
                if (ctx.build && ctx.build.id) {
                    startPolling(ctx, '', false, '');
                }
            }

            if((ctx.env.SHOW_RENDER_ERRORS||ctx.options.showRenderErrors||ctx.config.showRenderErrors) && ctx.build && ctx.build.id) {
                if(ctx.env.LT_USERNAME&&ctx.env.LT_ACCESS_KEY) {
                    startSSEListener(ctx);
                } else {
                    ctx.log.info('LT_USERNAME and LT_ACCESS_KEY are not set, set them to display render errors');
                }
            }

            updateLogContext({task: 'exec'});

            return new Promise((resolve, reject) => {
                const childProcess = spawn(ctx.args.execCommand[0], ctx.args.execCommand?.slice(1));

                // Handle standard output
                let totalOutput = '';
                
                // Buffer for stdout and stderr to handle incomplete lines
                let stdoutBuffer = '';
                let stderrBuffer = '';
                
                const processOutput = (data: Buffer, outputType: 'stdout' | 'stderr') => {
                    const bufferStr = data.toString('utf8');
                    const currentBuffer = outputType === 'stdout' ? stdoutBuffer : stderrBuffer;
                    let updatedBuffer = currentBuffer + bufferStr;
                    
                    // Process carriage returns properly: for lines ending with \r, keep only the text after the last \r
                    // This handles progressive updates like "Total ti\rTotal tim\rTotal time\n"
                    // by keeping only "Total time"
                    const lines = updatedBuffer.split('\n');
                    const processedLines: string[] = [];
                    let lastIncompleteLine = '';
                    
                    for (const line of lines) {
                        // If this line contains \r, split on \r and keep only the last part
                        if (line.includes('\r')) {
                            const parts = line.split('\r');
                            // Keep only the text after the last \r
                            const finalPart = parts[parts.length - 1];
                            processedLines.push(finalPart);
                        } else {
                            processedLines.push(line);
                        }
                    }
                    
                    // Keep the last incomplete line in the buffer
                    lastIncompleteLine = processedLines.pop() || '';
                    
                    if (outputType === 'stdout') {
                        stdoutBuffer = lastIncompleteLine;
                    } else {
                        stderrBuffer = lastIncompleteLine;
                    }
                    
                    // Emit only complete lines
                    if (processedLines.length > 0) {
                        const completeLines = processedLines.filter(line => line.trim() !== '').join('\n');
                        if (completeLines) {
                            totalOutput += completeLines + '\n';
                            task.output = chalk.gray(totalOutput);
                        }
                    }
                };
                
                if (!ctx.env.LT_SDK_SKIP_EXECUTION_LOGS) {
                    childProcess.stdout?.on('data', (data) => {
                        processOutput(data, 'stdout');
                    });
                    
                    childProcess.stderr?.on('data', (data) => {
                        processOutput(data, 'stderr');
                    });
                } else {
                    // Write logs to file when skipping terminal output
                    const logFileName = `execution-logs.log`;
                    const logFilePath = path.join(process.cwd(), logFileName);
                    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
                    
                    task.output = chalk.gray(`Execution logs being written to: ${logFileName}`);
                    
                    childProcess.stdout?.on('data', (data) => {
                        logStream.write(data);
                    });
                    
                    childProcess.stderr?.on('data', (data) => {
                        logStream.write(data);
                    });
                    
                    childProcess.on('close', () => {
                        logStream.end();
                    });
                }

                childProcess.on('error', (error) => {
                    task.output = chalk.gray(`error: ${error.message}`);
                    throw new Error(`Execution of '${ctx.args.execCommand?.join(' ')}' failed`);
                });

                childProcess.on('close', async (code, signal) => {
                    // Flush any remaining buffered output
                    if (stdoutBuffer || stderrBuffer) {
                        const remainingOutput = [stdoutBuffer, stderrBuffer]
                            .filter(b => b.trim() !== '')
                            .join('\n');
                        if (remainingOutput) {
                            totalOutput += remainingOutput;
                            task.output = chalk.gray(totalOutput);
                        }
                    }
                    
                    if (code !== null) {
                        task.title = `Execution of '${ctx.args.execCommand?.join(' ')}' completed; exited with code ${code}`;
                        if (code !== 0) {
                            process.exitCode = code
                        }
                    } else if (signal !== null) {
                        throw new Error(`Child process killed with signal ${signal}`);
                    }
                    
                    resolve();
                });
            });
        },
        rendererOptions: { persistentOutput: true },
        exitOnError: false
    }
}