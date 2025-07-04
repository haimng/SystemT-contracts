// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
// import "hardhat/console.sol";

contract SystemT is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  address public baseToken;
  address public tradeToken;
  uint24 public poolFee;
  IUniswapV3Pool public pool;
  ISwapRouter public uniswapRouter;
  IQuoter public quoter;

  bool public isTradeActive;
  uint256 public lastTradeTimestamp;
  bool public tradingStopped;

  address public trader;

  event Setup(address indexed baseToken, address indexed tradeToken, uint24 poolFee, address indexed pool, address router, address quoter);
  event Trade(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, bool isTradeActive);
  event SetIsTradeActive(bool isTradeActive);
  event SetTradingStopped(bool tradingStopped);
  event SetTrader(address indexed trader);
  event WithdrawToken(address indexed token, uint256 amount);

  function initialize() public initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(msg.sender);
    __ReentrancyGuard_init();
  }

  function setup(address _baseToken, address _tradeToken, uint24 _poolFee, address _pool, address _router, address _quoter) external onlyOwner {
    baseToken = _baseToken;
    tradeToken = _tradeToken;
    poolFee = _poolFee;
    pool = IUniswapV3Pool(_pool);
    uniswapRouter = ISwapRouter(_router);
    quoter = IQuoter(_quoter);
    emit Setup(_baseToken, _tradeToken, _poolFee, _pool, _router, _quoter);
  }

  function trade() external nonReentrant {
    require(msg.sender == owner() || msg.sender == trader, "Not authorized");
    require(!tradingStopped, "Trading is stopped");
    require(block.timestamp >= lastTradeTimestamp + 22 hours, "Trade allowed only once per day");
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
    uint256 tokenOutBefore = IERC20(tokenOut).balanceOf(address(this));
    uniswapRouter.exactInputSingle(params);
    uint256 tokenOutAfter = IERC20(tokenOut).balanceOf(address(this));
    IERC20(tokenIn).approve(address(uniswapRouter), 0);

    isTradeActive = !isTradeActive;
    lastTradeTimestamp = block.timestamp;
    emit Trade(tokenIn, tokenOut, tokenInAmount, tokenOutAfter - tokenOutBefore, isTradeActive);
  }

  function setIsTradeActive(bool _isTradeActive) external onlyOwner {
    isTradeActive = _isTradeActive;
    emit SetIsTradeActive(_isTradeActive);
  }

  function setTradingStopped(bool _stopped) external onlyOwner {
    tradingStopped = _stopped;
    emit SetTradingStopped(_stopped);
  }

  function setTrader(address _trader) external onlyOwner {
    trader = _trader;
    emit SetTrader(_trader);
  }

  function withdrawToken(address token) external onlyOwner {
    require(token == baseToken || token == tradeToken, "Invalid token");

    uint256 balance = IERC20(token).balanceOf(address(this));
    require(balance > 0, "No balance to withdraw");

    IERC20(token).transfer(owner(), balance);
    emit WithdrawToken(token, balance);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}