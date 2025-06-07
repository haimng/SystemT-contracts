declare module "@nomicfoundation/hardhat-ignition/modules" {
  export function buildModule(
    name: string,
    builder: (m: any) => any
  ): any;
}
