import { ethers } from "hardhat";
import { Contract } from "ethers";

const L1_ADDRESS = "0xD30e893D355b18a32BAd5A9FCa395A54acBC1c6F";

// npx hardhat run --network arbitrum scripts/transfer_ownership.ts
async function main() {
  const systemTProxyAddress = "TODO";
  const [deployer] = await ethers.getSigners();

  const SystemT = await ethers.getContractFactory("SystemT");
  const systemT = new Contract(systemTProxyAddress, SystemT.interface, deployer);

  const transferTx = await systemT.transferOwnership(L1_ADDRESS);
  await transferTx.wait();
  console.log("Ownership transferred to:", L1_ADDRESS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});