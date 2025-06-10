import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { parseUnits } from "ethers";

export const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const SWAP_POOL_WETH_USDC = '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8';
export const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
export const SWAP_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
export const SWAP_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const USDC_WHALE = '0x55fe002aeff02f77364de339a1292923a15844b8';
export const WETH_WHALE = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const USDC_UNITS = parseUnits('1', 6);
export const WETH_UNITS = parseUnits('1', 18);

describe("SystemT", function () {
  let owner: any;
  let trader: any;
  let other: any;
  let systemT: any;
  let baseToken: any;
  let tradeToken: any;
  let poolFee = 500;
  let pool: string = SWAP_POOL_WETH_USDC;
  let router: string = SWAP_ROUTER;
  let quoter: string = SWAP_QUOTER;

  before(async function () {
    [owner, trader, other] = await ethers.getSigners();

    baseToken = await ethers.getContractAt("IERC20", USDC);
    tradeToken = await ethers.getContractAt("IERC20", WETH);

    // Deploy SystemT contract
    const SystemT = await ethers.getContractFactory("SystemT");
    systemT = await upgrades.deployProxy(SystemT, [], { initializer: "initialize" });
    await systemT.waitForDeployment();
    await systemT.setup(baseToken, tradeToken, poolFee, pool, router, quoter);

    // Transfer USDC from whale to SystemT contract
    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    const whale = await ethers.getSigner(USDC_WHALE);
    const usdc = await ethers.getContractAt("IERC20", USDC);
    await usdc.connect(whale).transfer(systemT.target, USDC_UNITS * 1_000_000n);
  });

  it("should initialize correctly", async function () {
    expect(await systemT.owner()).to.equal(owner.address);
    expect(await systemT.isTradeActive()).to.equal(false);
  });

  it("should only allow owner to call setup", async function () {
    await expect(systemT.connect(other).setup(baseToken, tradeToken, poolFee, pool, router, quoter)).to.be.reverted;
  });

  it("should buy tradeToken with baseToken and update isTradeActive flag", async function () {
    const baseTokenBefore = await baseToken.balanceOf(systemT.target);
    const tradeTokenBefore = await tradeToken.balanceOf(systemT.target);
    console.log({baseTokenBefore: baseTokenBefore / USDC_UNITS, tradeTokenBefore: tradeTokenBefore / WETH_UNITS});
    expect(baseTokenBefore).to.be.gt(0);
    expect(tradeTokenBefore).to.equal(0);
    expect(await systemT.isTradeActive()).to.equal(false);

    await systemT.trade();
    const baseTokenAfter = await baseToken.balanceOf(systemT.target);
    const tradeTokenAfter = await tradeToken.balanceOf(systemT.target);
    console.log({baseTokenAfter: baseTokenAfter / USDC_UNITS, tradeTokenAfter: tradeTokenAfter / WETH_UNITS});
    expect(baseTokenAfter).to.equal(0);
    expect(tradeTokenAfter).to.be.gt(0);
    expect(await systemT.isTradeActive()).to.equal(true);

    const allowance = await baseToken.allowance(systemT.target, router);
    expect(allowance).to.equal(0);
  });

  it("should only allow one trade per day", async function () {
    await expect(systemT.trade()).to.be.revertedWith("Trade allowed only once per day");
  });

  it("should sell tradeToken for baseToken and update isTradeActive flag", async function () {
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);

    await systemT.trade();
    const baseTokenAfter = await baseToken.balanceOf(systemT.target);
    const tradeTokenAfter = await tradeToken.balanceOf(systemT.target);
    console.log({baseTokenAfter: baseTokenAfter / USDC_UNITS, tradeTokenAfter: tradeTokenAfter / WETH_UNITS});
    expect(baseTokenAfter).to.be.gt(0);
    expect(tradeTokenAfter).to.equal(0);
    expect(await systemT.isTradeActive()).to.equal(false);

    const allowance = await tradeToken.allowance(systemT.target, router);
    expect(allowance).to.equal(0);
  });

  it("should only allow owner to set isTradeActive", async function () {
    await expect(systemT.connect(other).setIsTradeActive(true)).to.be.reverted;
  });

  it("should allow owner to set isTradeActive", async function () {
    await systemT.setIsTradeActive(true);
    expect(await systemT.isTradeActive()).to.equal(true);
    await systemT.setIsTradeActive(false);
    expect(await systemT.isTradeActive()).to.equal(false);
  });

  it("should only allow owner to set tradingStopped", async function () {
    await expect(systemT.connect(other).setTradingStopped(true)).to.be.reverted;

    await systemT.setTradingStopped(true);
    expect(await systemT.tradingStopped()).to.equal(true);

    await systemT.setTradingStopped(false);
    expect(await systemT.tradingStopped()).to.equal(false);
  });

  it("should revert trade when tradingStopped is true", async function () {
    await systemT.setTradingStopped(true);
    await expect(systemT.trade()).to.be.revertedWith("Trading is stopped");
    await systemT.setTradingStopped(false);
  });

  it("should only allow owner to set trader", async function () {
    await expect(systemT.connect(other).setTrader(other.address)).to.be.reverted;

    await systemT.setTrader(trader.address);
    expect(await systemT.trader()).to.equal(trader.address);
  });

  it("should allow trader to trade", async function () {
    await expect(systemT.connect(other).trade()).to.be.revertedWith("Not authorized");

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await expect(systemT.connect(trader).trade()).to.not.be.reverted;
  });

  it("should revert reentrant call to trade", async function () {
    // Deploy a malicious contract that tries to reenter trade
    const maliciousSource = `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.0;
      contract Malicious {
        address public systemT;
        constructor(address _systemT) { systemT = _systemT; }
        function attack() external {
          (bool success,) = systemT.call(abi.encodeWithSignature("trade()"));
          require(success, "First trade failed");
        }
        fallback() external payable {
          (bool success,) = systemT.call(abi.encodeWithSignature("trade()"));
          require(success, "Reentrant trade failed");
        }
      }
    `;

    // Compile the contract
    const solc = require("solc");
    const input = {
      language: "Solidity",
      sources: {
        "Malicious.sol": {
          content: maliciousSource,
        },
      },
      settings: {
        outputSelection: {
          "*": {
            "*": ["abi", "evm.bytecode"],
          },
        },
      },
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const contractFile = output.contracts["Malicious.sol"]["Malicious"];
    const MaliciousFactory = new ethers.ContractFactory(contractFile.abi, contractFile.evm.bytecode.object, owner);
    const malicious = await MaliciousFactory.deploy(systemT.target);
    await malicious.waitForDeployment();

    // Create a contract instance with ABI for attack()
    const maliciousWithAbi = await ethers.getContractAt(
      [
        "function attack() external"
      ],
      malicious.target
    );

    // Try to call attack, expecting revert due to nonReentrant
    await expect(maliciousWithAbi.attack()).to.be.reverted;
  });

  it("should only allow owner to withdraw baseToken and tradeToken", async function () {
    // Transfer some USDC to contract for testing
    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    const usdcWhale = await ethers.getSigner(USDC_WHALE);
    const usdc = await ethers.getContractAt("IERC20", USDC);
    await usdc.connect(usdcWhale).transfer(systemT.target, USDC_UNITS * 10n);

    // Transfer some WETH to contract for testing
    await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
    const wethWhale = await ethers.getSigner(WETH_WHALE);
    const weth = await ethers.getContractAt("IERC20", WETH);
    await weth.connect(wethWhale).transfer(systemT.target, WETH_UNITS * 10n);

    // Owner can withdraw baseToken (USDC)
    const ownerBaseBalanceBefore = await baseToken.balanceOf(owner.address);
    const contractBaseBalance = await baseToken.balanceOf(systemT.target);
    await expect(systemT.withdrawToken(baseToken)).to.emit(baseToken, "Transfer");
    const ownerBaseBalanceAfter = await baseToken.balanceOf(owner.address);
    const contractBaseBalanceAfter = await baseToken.balanceOf(systemT.target);
    expect(ownerBaseBalanceAfter - ownerBaseBalanceBefore).to.equal(contractBaseBalance);
    expect(contractBaseBalanceAfter).to.equal(0);

    // Owner can withdraw tradeToken (WETH)
    const ownerTradeBalanceBefore = await tradeToken.balanceOf(owner.address);
    const contractTradeBalance = await tradeToken.balanceOf(systemT.target);
    await expect(systemT.withdrawToken(tradeToken)).to.emit(tradeToken, "Transfer");
    const ownerTradeBalanceAfter = await tradeToken.balanceOf(owner.address);
    const contractTradeBalanceAfter = await tradeToken.balanceOf(systemT.target);
    expect(ownerTradeBalanceAfter - ownerTradeBalanceBefore).to.equal(contractTradeBalance);
    expect(contractTradeBalanceAfter).to.equal(0);
  });

  it("should revert if non-owner tries to withdraw", async function () {
    await expect(systemT.connect(other).withdrawToken(baseToken)).to.be.reverted;
  });

  it("should revert if token is not baseToken or tradeToken", async function () {
    await expect(systemT.withdrawToken(SWAP_FACTORY)).to.be.revertedWith("Invalid token");
  });

  it("should revert if no balance to withdraw", async function () {
    // Withdraw all baseToken first
    const contractBaseBalance = await baseToken.balanceOf(systemT.target);
    if (contractBaseBalance > 0) {
      await systemT.withdrawToken(baseToken);
    }
    await expect(systemT.withdrawToken(baseToken)).to.be.revertedWith("No balance to withdraw");
  });

});
