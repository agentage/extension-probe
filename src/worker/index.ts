import { type WorkerContext } from '@agentage/extension';

// Every minute one tick into the store; the kit never runs it twice at once and saves each run.
export function create({ schedule, store, log }: WorkerContext) {
  schedule(
    'tick',
    '* * * * *',
    async () => {
      const { rows } = await store.query('insert into ticks (job) values ($1) returning id', [
        'tick',
      ]);
      log.info(`tick ${String(rows[0]?.['id'])}`);
    },
    { timeout: '30s' }
  );
}
