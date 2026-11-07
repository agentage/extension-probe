// What the echo tool answers, so useHost().tool is typed from the tool list (the mcpc snapshot).
declare module '@agentage/widget' {
  interface ToolOutputs {
    probe__echo: { msg: string };
  }
}

export {};
