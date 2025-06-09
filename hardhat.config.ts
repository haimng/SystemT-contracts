import "ts-node/register";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import '@openzeppelin/hardhat-upgrades';
import { HardhatUserConfig } from "hardhat/config";

const secrets = require('./secrets_deployer.json');
const { privateKey, alchemyId, etherscanApiKey } = secrets;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyId}`,
        blockNumber: 22655661  // 2025-06-07 15:30 PDT
      }
    },
    // sepolia: {
    //   url: `https://eth-sepolia.g.alchemy.com/v2/${alchemyId}`,
    //   accounts: [privateKey]
    // },
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${alchemyId}`,
      accounts: [privateKey]
    }
  },
  etherscan: {
    apiKey: etherscanApiKey,
  }
};

export default config;
