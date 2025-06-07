import { ethers } from "hardhat";
import { expect } from "chai";

describe("Lock contract", function () {
  let lock: any;
  let owner: any;
  let otherAccount: any;
  let unlockTime: number;
  let lockedAmount = ethers.parseEther("1");
  let ownerAddress: string;
  let otherAddress: string;

  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    otherAddress = await otherAccount.getAddress();
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    if (!block) {
      throw new Error("Failed to fetch the latest block");
    }
    unlockTime = block.timestamp + 10 * 60; // 10 minutes from now
    const Lock = await ethers.getContractFactory("Lock");
    lock = await Lock.deploy(unlockTime, { value: lockedAmount });
    await lock.waitForDeployment();
  });

  it("Should set the right unlockTime", async function () {
    expect(await lock.unlockTime()).to.equal(unlockTime);
  });

  it("Should set the right owner", async function () {
    expect(await lock.owner()).to.equal(ownerAddress);
  });

  it("Should receive and store the funds", async function () {
    expect(await ethers.provider.getBalance(lock.target)).to.equal(lockedAmount);
  });

  it("Should not allow withdraw before unlockTime", async function () {
    await expect((lock as any).withdraw()).to.be.revertedWith("You can't withdraw yet");
  });

  it("Should allow owner to withdraw after unlockTime", async function () {
    await ethers.provider.send("evm_increaseTime", [10*60 + 1]);
    await ethers.provider.send("evm_mine");
    await expect((lock as any).withdraw()).to.changeEtherBalances(
      [owner, lock],
      [lockedAmount, -lockedAmount]
    );
  });

  it("Should not allow non-owner to withdraw", async function () {
    await ethers.provider.send("evm_increaseTime", [10*60 + 1]);
    await ethers.provider.send("evm_mine");
    await expect((lock.connect(otherAccount) as any).withdraw()).to.be.revertedWith(
      "You aren't the owner"
    );
  });
});