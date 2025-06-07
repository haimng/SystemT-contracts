// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
// import "hardhat/console.sol";

contract SystemT is Initializable, UUPSUpgradeable, OwnableUpgradeable {
  address public baseToken;
  address public tradeToken;
  ISwapRouter public uniswapRouter;
  IQuoter public quoter;
  uint24 public poolFee;

  bool public isTradeActive;

  function initialize() public initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(msg.sender);
  }

  function setup(address _baseToken, address _tradeToken, address _router, address _quoter, uint24 _poolFee) external onlyOwner {
    baseToken = _baseToken;
    tradeToken = _tradeToken;
    uniswapRouter = ISwapRouter(_router);
    quoter = IQuoter(_quoter);
    poolFee = _poolFee;
  }

  function trade() external onlyOwner {
    require(baseToken != address(0) && tradeToken != address(0) && address(uniswapRouter) != address(0) && address(quoter) != address(0), "DEX not set");

    address tokenIn = isTradeActive ? tradeToken : baseToken;
    address tokenOut = isTradeActive ? baseToken : tradeToken;

    uint256 tokenInAmount = IERC20(tokenIn).balanceOf(address(this));
    require(tokenInAmount > 0, "No tokenIn balance");

    uint256 estimatedOut = quoter.quoteExactInputSingle(tokenIn, tokenOut, poolFee, tokenInAmount, 0);
    uint256 minTokenOut = (estimatedOut * 98) / 100;
    // console.log("estimatedOut: %s, minTokenOut: %s", estimatedOut / 1e18, minTokenOut / 1e18);

    IERC20(tokenIn).approve(address(uniswapRouter), tokenInAmount);
    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      fee: poolFee,
      recipient: address(this),
      deadline: block.timestamp + 600,
      amountIn: tokenInAmount,
      amountOutMinimum: minTokenOut,
      sqrtPriceLimitX96: 0
    });
    uniswapRouter.exactInputSingle(params);

    isTradeActive = !isTradeActive;
  }

  function setIsTradeActive(bool _isTradeActive) external onlyOwner {
    isTradeActive = _isTradeActive;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}