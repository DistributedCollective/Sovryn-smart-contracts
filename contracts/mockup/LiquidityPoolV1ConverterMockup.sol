pragma solidity 0.5.17;

import "../interfaces/IERC20.sol";

contract LiquidityPoolV1ConverterMockup {
	IERC20[] public reserveTokens;
	IERC20 wrbtcToken;
	uint256 totalFeeMockupValue;
	address feesController;

	constructor(IERC20 _token0, IERC20 _token1) public {
		reserveTokens.push(_token0);
		reserveTokens.push(_token1);
	}

	function setFeesController(address _feesController) public {
		feesController = _feesController;
	}

	function setWrbtcToken(IERC20 _wrbtcToken) public {
		wrbtcToken = _wrbtcToken;
	}

	function setTotalFeeMockupValue(uint256 _totalFeeMockupValue) public {
		totalFeeMockupValue = _totalFeeMockupValue;
	}

	function withdrawFees(address _receiver) external returns (uint256) {
		require(msg.sender == feesController, "unauthorized");

		// transfer wrbtc
		wrbtcToken.transfer(_receiver, totalFeeMockupValue);
		return totalFeeMockupValue;
	}
}
