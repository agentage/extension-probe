import { type CliContext } from '@agentage/extension';

// One handler per command in agentage.commands: `agentage ping [msg]`.
export function create({ out, args }: CliContext) {
  return {
    ping: async () => {
      const { msg } = args;
      out.log(msg ? `pong ${msg}` : 'pong');
      return 0;
    },
  };
}
