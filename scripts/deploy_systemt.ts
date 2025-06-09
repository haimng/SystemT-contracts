import { ethers, upgrades, network } from "hardhat";

const L1_ADDRESS = "0xD30e893D355b18a32BAd5A9FCa395A54acBC1c6F";

const DEX_CONFIG = {
  arbitrum: [
    {
      baseToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
      tradeToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6", // Uniswap V3 Quoter
      poolFee: 500 // 0.05%
    }
  ]
}

// npx hardhat run --network arbitrum scripts/deploy_systemt.ts
// npx hardhat verify --network arbitrum 0x7be86Cb24247fE3F240d5238A10cF759129035fB
async function main() {
  const networkName = "arbitrum";
  const contractIndex = 0;

  const [deployer] = await ethers.getSigners();
  console.log({ network: network.name, deployer: deployer.address });
  if (networkName !== network.name)  return console.error("Supported networks: ", Object.keys(DEX_CONFIG));

  const dexConfig = DEX_CONFIG[networkName];
  const { baseToken, tradeToken, router, quoter, poolFee } = dexConfig[contractIndex];
  console.log({ baseToken, tradeToken, router, quoter, poolFee });

  // Deploy SystemT contract
  const SystemT = await ethers.getContractFactory("SystemT");
  const systemT = await upgrades.deployProxy(SystemT, [], { initializer: "initialize" });
  await systemT.waitForDeployment();
  console.log("SystemT deployed to:", await systemT.getAddress());

  // Setup SystemT
  const setupTx = await systemT.setup(baseToken, tradeToken, router, quoter, poolFee);
  await setupTx.wait();
  console.log("SystemT setup completed.");

  // Transfer ownership to L1 address
  const transferTx = await systemT.transferOwnership(L1_ADDRESS);
  await transferTx.wait();
  console.log("Ownership transferred to:", L1_ADDRESS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});