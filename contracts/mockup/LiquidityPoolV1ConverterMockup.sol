pragma solidity 0.5.17;

import "../interfaces/IERC20.sol";

contract LiquidityPoolV1ConverterMockup {
    IERC20[] public reserveTokens;

	constructor(IERC20 _token0, IERC20 _token1) public {
		reserveTokens.push(_token0);
        reserveTokens.push(_token1);
	}
}