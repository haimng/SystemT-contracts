import { ethers, upgrades, network } from "hardhat";

const SYSTEMT_PROXY_ADDRESS = "0x9819fCD1Cd48c6468f635F3A1C5FE66dd9b01001";

// npx hardhat run --network arbitrum scripts/upgrade_systemt.ts
// npx hardhat verify --network arbitrum <Impl-Address>
async function main() {  
  const proxyAddress = SYSTEMT_PROXY_ADDRESS;
  console.log({ network: network.name, proxyAddress });

  const SystemT = await ethers.getContractFactory("SystemT");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, SystemT);
  await upgraded.waitForDeployment?.();

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("SystemT upgraded. New implementation address:", implAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});