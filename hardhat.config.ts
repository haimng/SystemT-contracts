import "ts-node/register";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import '@openzeppelin/hardhat-upgrades';
import { HardhatUserConfig } from "hardhat/config";

const secrets = require('./secrets_test.json');
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
    // goerli: {
    //   url: `https://eth-goerli.alchemyapi.io/v2/${alchemyId}`,
    //   accounts: [privateKey]
    // }
  }
};

export default config;
