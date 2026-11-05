// What probe__echo answers, so useHost().tool is typed from the tool list (probe.mcpc.json).
declare module '@agentage/widget' {
  interface ToolOutputs {
    probe__echo: { msg: string };
  }
}

export {};
