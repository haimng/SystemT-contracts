import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { parseUnits } from "ethers";

export const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
export const SWAP_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
export const SWAP_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const SWAP_POOL_WETH_USDC = '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8';
export const USDC_WHALE = '0x55fe002aeff02f77364de339a1292923a15844b8';
export const USDC_UNITS = parseUnits('1', 6);
export const WETH_UNITS = parseUnits('1', 18);

describe("SystemT", function () {
  let owner: any;
  let other: any;
  let systemT: any;
  let baseToken: any;
  let tradeToken: any;
  let router: string = SWAP_ROUTER;
  let quoter: string = SWAP_QUOTER;
  let poolFee = 500;

  before(async function () {
    [owner, other] = await ethers.getSigners();

    baseToken = await ethers.getContractAt("IERC20", USDC);
    tradeToken = await ethers.getContractAt("IERC20", WETH);

    // Deploy SystemT contract
    const SystemT = await ethers.getContractFactory("SystemT");
    systemT = await upgrades.deployProxy(SystemT, [], { initializer: "initialize" });
    await systemT.waitForDeployment();
    await systemT.setup(baseToken, tradeToken, router, quoter, poolFee);

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
    await expect(systemT.connect(other).setup(baseToken, tradeToken, router, quoter, poolFee)).to.be.reverted;
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

  it("should sell tradeToken for baseToken and update isTradeActive flag", async function () {
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

});
