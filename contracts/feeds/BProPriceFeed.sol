pragma solidity >=0.5.0 <0.6.0;

import "./PriceFeeds.sol";
import "./IMoCState.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/Address.sol";

contract BProPriceFeed is IPriceFeedsExt, Ownable {
    address public mocStateAddress;

    event SetMoCStateAddress(
        address indexed mocStateAddress,
        address changerAddress
    );

    /**
     * @dev initializes a new MoC state
     *
     * @param _mocStateAddress MoC state address
     */
    constructor(address _mocStateAddress) public {
        setMoCStateAddress(_mocStateAddress);
    }

    /**
     * @dev BPro USD PRICE
     * @return the BPro USD Price [using mocPrecision]
     */
    function latestAnswer() external view returns (uint256) {
        IMoCState _mocState = IMoCState(mocStateAddress);
        return _mocState.bproUsdPrice();
    }

    /**
     * @dev returns the update time.
     *
     * @return always returns current block's timestamp
     */
    function latestTimestamp() external view returns (uint256) {
        return now; // MoC state doesn't return update timestamp
    }

    /**
     * @dev set MoC state address
     *
     * @param _mocStateAddress MoC state address
     */
    function setMoCStateAddress(address _mocStateAddress) public onlyOwner {
        require(
            Address.isContract(_mocStateAddress),
            "_mocStateAddress not a contract"
        );
        mocStateAddress = _mocStateAddress;
        emit SetMoCStateAddress(mocStateAddress, msg.sender);
    }
}
