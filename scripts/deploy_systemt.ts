import { ethers, upgrades, network } from "hardhat";

const L1_ADDRESS = "0xD30e893D355b18a32BAd5A9FCa395A54acBC1c6F";

const DEX_CONFIG = {
  arbitrum: [
    // SystemT WETH/USDC ethusd:12971486
    {
      baseToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
      tradeToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
      poolFee: 500, // 0.05%
      pool: "0xC6962004f452bE9203591991D15f6b388e09E8D0", // Uniswap V3 Pool WETH/USDC
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6", // Uniswap V3 Quoter
    },
    // SystemT WBTC/USDT btcusd:14016393
    {
      baseToken: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT
      tradeToken: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // WBTC
      poolFee: 500, // 0.05%
      pool: "0x5969EFddE3cF5C0D9a88aE51E47d721096A97203", // Uniswap V3 Pool WBTC/USDT
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6", // Uniswap V3 Quoter
    }
  ]
}

// npx hardhat run --network arbitrum scripts/deploy_systemt.ts
// npx hardhat verify --network arbitrum <Impl-Address>
async function main() {
  const networkName = "arbitrum";
  const contractIndex = 1;

  const [deployer] = await ethers.getSigners();
  console.log({ network: network.name, deployer: deployer.address });
  if (networkName !== network.name)  return console.error("Supported networks: ", Object.keys(DEX_CONFIG));

  const dexConfig = DEX_CONFIG[networkName];
  const { baseToken, tradeToken, poolFee, pool, router, quoter } = dexConfig[contractIndex];
  console.log({ baseToken, tradeToken, poolFee, pool, router, quoter });

  // Deploy SystemT contract
  const SystemT = await ethers.getContractFactory("SystemT");
  const systemT = await upgrades.deployProxy(SystemT, [], { initializer: "initialize" });
  await systemT.waitForDeployment();
  console.log("SystemT deployed to:", await systemT.getAddress());

  // Setup SystemT
  const setupTx = await systemT.setup(baseToken, tradeToken, poolFee, pool, router, quoter);
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