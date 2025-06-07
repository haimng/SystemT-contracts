import "ts-node/register";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import { HardhatUserConfig } from "hardhat/config";

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
  }
};

export default config;
