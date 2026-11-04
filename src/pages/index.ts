import { versionPage, type PagesContext, type PagesSite } from '@agentage/extension';

// The kit serves this map; "/" names what runs: probe {version} · {commit}.
export const create = (ctx: PagesContext): PagesSite => ({ '/': versionPage(ctx) });
