import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import { updateLogContext } from '../lib/logger.js';
import chalk from 'chalk';
import { startPolling } from '../lib/utils.js';
import { unlinkSync } from 'fs';
import constants from '../lib/constants.js';
import fs from 'fs';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Finalizing build`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'finalizeBuild'});

            try {
                if (ctx.build.id) {
                    await ctx.client.finalizeBuild(ctx.build.id, ctx.totalSnapshots, ctx.log);
                }
                if (ctx.build.hasDiscoveryError){
                    ctx.log.warn(`We found some network errors while capturing DOM snapshots. These network errors may cause visual differences in your screenshots. Please go to ${ctx.build.url} for more details`);
                }
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Finalize build failed');
            }
            let buildUrls = `build url: ${ctx.build.url}\n`;

            for (const [sessionId, capabilities] of ctx.sessionCapabilitiesMap.entries()) {
                try {
                    const buildId = capabilities?.buildId || '';
                    const projectToken = capabilities?.projectToken || '';
                    const totalSnapshots = capabilities?.snapshotCount || 0;
                    const sessionBuildUrl = capabilities?.buildURL || '';
                    const testId = capabilities?.id || '';

                    if (ctx.options.fetchResults && ctx.fetchResultsForBuild) {
                        if (!ctx.fetchResultsForBuild.includes(buildId)) {
                            let is_baseline;
                            if (capabilities.baseline) {
                                is_baseline = true;
                            } else {
                                is_baseline = false;
                            }
                            console.log(`start polling was called at finalize build for buildId: ${buildId}`)
                            startPolling(ctx, buildId, is_baseline, capabilities.projectToken);
                            await new Promise(resolve => setTimeout(resolve, 7000));
                            ctx.fetchResultsForBuild.push(buildId);
                        }
                    }
            
                    if (buildId && projectToken) {
                        await ctx.client.finalizeBuildForCapsWithToken(buildId, totalSnapshots, projectToken, ctx.log);
                    }

                    if (testId && buildId) {
                        buildUrls += `TestId ${testId}: ${sessionBuildUrl}\n`;
                    }
                } catch (error: any) {
                    ctx.log.debug(`Error finalizing build for session ${sessionId}: ${error.message}`);
                }
            }
            task.output = chalk.gray(buildUrls);
            task.title = 'Finalized build';
           
            // cleanup and upload logs
            try {
                await ctx.browser?.close();
                ctx.log.debug(`Closed browser`);
                await ctx.server?.close();
                ctx.log.debug(`Closed server`);
                if (ctx.isSnapshotCaptured) {
                    ctx.log.debug(`Log file to be uploaded`)
                    let resp = await ctx.client.getS3PreSignedURL(ctx);
                    await ctx.client.uploadLogs(ctx, resp.data.url);
                }
            } catch (error: any) {
                ctx.log.debug(error);
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}