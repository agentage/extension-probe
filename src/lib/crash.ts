// Part code may not name the process global, so an exit is an uncaught throw on the next tick.
export const crash = (): void => {
  setImmediate(() => {
    throw new Error('exit requested');
  });
};
