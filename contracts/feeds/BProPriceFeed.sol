pragma solidity >=0.5.0 <0.6.0;

import "./PriceFeeds.sol";
import "./IMoCState.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/Address.sol";

/**
 * @title The BPro Price Feed contract.
 *
 * This contract gets/sets the MoC (Money on Chain) address of its state
 * contract and queries its method bproUsdPrice to get bPro/USD valuation.
 * */
contract BProPriceFeed is IPriceFeedsExt, Ownable {
	address public mocStateAddress;

	event SetMoCStateAddress(address indexed mocStateAddress, address changerAddress);

	/**
	 * @notice Initializes a new MoC state.
	 *
	 * @param _mocStateAddress MoC state address
	 * */
	constructor(address _mocStateAddress) public {
		setMoCStateAddress(_mocStateAddress);
	}

	/**
	 * @notice Get BPro USD price.
	 *
	 * @return the BPro USD Price [using mocPrecision]
	 */
	function latestAnswer() external view returns (uint256) {
		IMoCState _mocState = IMoCState(mocStateAddress);
		return _mocState.bproUsdPrice();
	}

	/**
	 * @notice Supposed to get the MoC update time, but instead
	 * get the current timestamp.
	 *
	 * @return Always returns current block's timestamp.
	 * */
	function latestTimestamp() external view returns (uint256) {
		return now; /// MoC state doesn't return update timestamp.
	}

	/**
	 * @notice Set MoC state address.
	 *
	 * @param _mocStateAddress The MoC state address.
	 * */
	function setMoCStateAddress(address _mocStateAddress) public onlyOwner {
		require(Address.isContract(_mocStateAddress), "_mocStateAddress not a contract");
		mocStateAddress = _mocStateAddress;
		emit SetMoCStateAddress(mocStateAddress, msg.sender);
	}
}
