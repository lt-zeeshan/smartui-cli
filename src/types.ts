import { Server, IncomingMessage, ServerResponse } from 'http'
import { FastifyInstance } from 'fastify'
import httpClient from './lib/httpClient.js'
import type { Logger } from 'winston'
import { ListrTaskWrapper, ListrRenderer } from "listr2";
import { Browser } from '@playwright/test';
import snapshotQueue from './lib/snapshotQueue.js';

export interface Context {
    env: Env;
    log: Logger;
    task?: ListrTaskWrapper<Context, typeof ListrRenderer, typeof ListrRenderer>;
    server?: FastifyInstance<Server, IncomingMessage, ServerResponse>;
    client: httpClient;
    browser?: Browser;
    authenticatedInitially?: boolean;
    snapshotQueue?: snapshotQueue;
    config: {
        web?: WebConfig;
        mobile?: MobileConfig,
        waitForPageRender: number;
        waitForTimeout: number;
        waitForDiscovery: number;
        enableJavaScript: boolean;
        cliEnableJavaScript: boolean;
        scrollTime: number;
        allowedHostnames: Array<string>;
        allowedAssets: Array<string>;
        basicAuthorization: basicAuth | undefined;
        smartIgnore: boolean;
        delayedUpload: boolean;
        useGlobalCache: boolean;
        figma?: FigmaWebConfig;
        ignoreHTTPSErrors : boolean;
        skipBuildCreation?: boolean;
        tunnel?: boolean;
        tunnelName?: string;
    };
    uploadFilePath: string;
    webStaticConfig: WebStaticConfig;
    build: Build;
    git: Git;
    args: {
        execCommand?: Array<string>
    }
    tunnelDetails: {
        tunnelPort: number;
        tunnelHost: string;
        tunnelName: string;
    }
    options: {
        parallel?: number,
        force?: boolean,
        markBaseline?: boolean,
        buildName?: string,
        port?: number,
        ignoreResolutions?: boolean,
        fileExtension?: Array<string>,
        stripExtension?: boolean,
        ignorePattern?: Array<string>,
        fetchResults?: boolean,
        fetchResultsFileName?: string
    }
    cliVersion: string;
    totalSnapshots: number;
    figmaDesignConfig?: FigmaDesignConfig;
    testType?: string;
    isStartExec ?: boolean;
    isSnapshotCaptured ?: boolean;
    sessionCapabilitiesMap?: Map<string, any[]>;
    buildToSnapshotCountMap?: Map<string, number>;
    fetchResultsForBuild?: Array<string>
}

export interface Env {
    PROJECT_TOKEN: string;
    SMARTUI_CLIENT_API_URL: string;
    SMARTUI_DO_NOT_USE_CAPTURED_COOKIES: boolean;
    SMARTUI_GIT_INFO_FILEPATH: string | undefined;
    HTTP_PROXY: string | undefined;
    HTTPS_PROXY: string | undefined;
    SMARTUI_HTTP_PROXY: string | undefined;
    SMARTUI_HTTPS_PROXY: string | undefined;
    GITHUB_ACTIONS: string | undefined;
    FIGMA_TOKEN: string | undefined;
    LT_USERNAME : string | undefined;
    LT_ACCESS_KEY : string | undefined;
    LT_SDK_DEBUG: boolean;
    BASELINE_BRANCH: string | undefined;
    CURRENT_BRANCH: string | undefined;
    PROJECT_NAME: string | undefined;
    SMARTUI_API_PROXY: string | undefined;
    SMARTUI_API_SKIP_CERTIFICATES: boolean;
}

export interface Snapshot {
    url: string;
    name: string;
    dom: Record<string, any>;
    options?: {
        ignoreDOM?: {
            id?: Array<string>,
            class?: Array<string>,
            cssSelector?: Array<string>,
            xpath?: Array<string>
        },
        selectDOM?: {
            id?: Array<string>,
            class?: Array<string>,
            cssSelector?: Array<string>,
            xpath?: Array<string>
        },
        element?: {
            id?: string,
            class?: string,
            cssSelector?: string,
            xpath?: string
        },
        web?: {
            browsers?: string[],
            viewports: ([number] | [number, number])[]
        },
        mobile?: {
            devices: string[],
            fullPage?: boolean,
            orientation?: string
        },
        loadDomContent?: boolean;
        ignoreType?: string[],
        sessionId?: string
    }
}

export interface ProcessedSnapshot {
    url: string,
    name: string,
    dom: string,
    resources: Record<string, any>,
    options: {
        ignoreBoxes?: Record<string, Array<Record<string, number>>>,
        selectBoxes?: Record<string, Array<Record<string, number>>>
    }
}

export interface Git {
    branch: string;
    commitId: string;
    commitAuthor: string;
    commitMessage: string;
    githubURL?: string;
    baselineBranch?: string;
}

export interface Build {
    id: string;
    name: string;
    url: string;
    baseline: boolean;
    useKafkaFlow: boolean;
    hasDiscoveryError: boolean;
}

export interface WebConfig {
    browsers: Array<string>;
    viewports: Array<{ width: number, height: number }>;
}

export interface MobileConfig {
    devices: Array<string>;
    fullPage?: boolean;
    orientation?: string;
}

export type WebStaticConfig = Array<{
    name: string;
    url: string;
    waitForTimeout?: number
}>;

export type FigmaConfigItem = {
    figma_file_token: string;
    figma_ids: string[];
};

export type FigmaDesignConfig = {
    depth: number;
    figma_config: FigmaConfigItem[];
};

export interface basicAuth {
    username: string;
    password: string;
}

export interface FigmaWebConfig {
    autoDetectViewports: Array<string>;
    configs: Array<{ figma_file_token: string, figma_ids: Array<string>, screenshot_names:Array<string> }>;
}


export interface ViewportErrors {
    statusCode: "aborted" | "404" | string;
    url: string;
    resourceType: string;
  }
  
export interface DiscoveryErrors {
    name: string;
    url: string;
    timestamp: string;
    snapshotUUID: string;
    browsers: {
      [browserName: string]: {
        [viewport: string]: ViewportErrors[];
      };
    };
  }