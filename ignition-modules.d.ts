declare module "@nomicfoundation/hardhat-ignition/modules" {
  // Add more specific types as needed
  export function buildModule(
    name: string,
    builder: (m: any) => any
  ): any;
}
