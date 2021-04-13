pragma solidity ^0.5.17;

import "../../openzeppelin/ERC20Detailed.sol";
import "../../openzeppelin/IERC20_.sol";
import "../../openzeppelin/ERC20.sol";
import "../../openzeppelin/Ownable.sol";
import "../Staking/SafeMath96.sol";
import "../Staking/IStaking.sol";
import "../../token/IApproveAndCall.sol";
import "../ApprovalReceiver.sol";

// TODO should be set as protocolTokenAddress (ProtocolSettings.setProtocolTokenAddress)
// TODO PriceFeeds._protocolTokenAddress ?

/**
 * @title Sovryn Reward Token.
 * @notice The RSOV token (Sovryn Reward Token) goal is to allow users to get
 * rewards through the generation of protocol fees. The mint function accepts
 * SOV tokens and mints the same amount of RSOV tokens. When burning RSOV
 * tokens, the user gets 1/14th of the tokens sent back to him and the rest
 * get staked in the user’s behalf with a schedule of 4 weeks cliff and period
 * 1 year duration.
 * */
contract RSOV is ERC20, ERC20Detailed, Ownable, SafeMath96, ApprovalReceiver {
	
	/* Storage */

	string constant NAME = "Sovryn Reward Token";
	string constant SYMBOL = "RSOV";
	uint8 constant DECIMALS = 18;

	/// @notice Constants used for computing the vesting dates.
	uint256 constant FOUR_WEEKS = 4 weeks;
	uint256 constant YEAR = 52 weeks;
	/// @notice Amount of tokens divided by this constant will be transferred.
	uint96 constant DIRECT_TRANSFER_PART = 14;

	/// @notice The SOV token contract.
	IERC20_ public SOV;
	/// @notice The staking contract.
	IStaking public staking;


	/* Events */

	event Mint(address indexed sender, uint256 amount);
	event Burn(address indexed sender, uint256 amount);


	/* Functions */

	/**
	 * @notice Creates reward token RSOV.
	 * @param _SOV The SOV token address.
	 * @param _staking The staking contract address.
	 * */
	constructor(address _SOV, address _staking) public ERC20Detailed(NAME, SYMBOL, DECIMALS) {
		require(_SOV != address(0), "RSOV::SOV address invalid");
		require(_staking != address(0), "RSOV::staking address invalid");

		SOV = IERC20_(_SOV);
		staking = IStaking(_staking);
	}

	/**
	 * @notice Holds SOV tokens and mints the respective amount of RSOV tokens.
	 * @param _amount The amount of tokens to be mint.
	 */
	function mint(uint96 _amount) public {
		_mintTo(msg.sender, _amount);
	}

	/**
	 * @notice Holds SOV tokens and mints the respective amount of RSOV tokens.
	 * @dev This function will be invoked from receiveApproval.
	 * @dev SOV.approveAndCall -> this.receiveApproval -> this.mintWithApproval
	 * @param _sender The sender of SOV.approveAndCall
	 * @param _amount The amount of tokens to be mint.
	 */
	function mintWithApproval(address _sender, uint96 _amount) public onlyThisContract {
		_mintTo(_sender, _amount);
	}

	/**
	 * @notice The actual minting process, holding SOV and minting RSOV tokens.
	 * @param _sender The recipient of the minted tokens
	 * @param _amount The amount of tokens to be minted.
	 */
	function _mintTo(address _sender, uint96 _amount) internal {
		require(_amount > 0, "RSOV::mint: amount invalid");

		/// @notice Holds SOV tokens.
		bool success = SOV.transferFrom(_sender, address(this), _amount);
		require(success);

		/// @notice Mints RSOV tokens.
		/// @dev uses openzeppelin/ERC20.sol internal _mint function
		_mint(_sender, _amount);

		emit Mint(_sender, _amount);
	}

	/**
	 * @notice Burns RSOV tokens and stakes the respective amount SOV tokens in the user's behalf.
	 * @param _amount The amount of tokens to be burnt.
	 */
	function burn(uint96 _amount) public {
		require(_amount > 0, "RSOV:: burn: amount invalid");

		/// @notice Burns RSOV tokens.
		_burn(msg.sender, _amount);

		/// @notice Transfer 1/14 of amount directly to the user.
		/// If amount is too small it won't be transferred.
		uint96 transferAmount = _amount / DIRECT_TRANSFER_PART;
		if (transferAmount > 0) {
			SOV.transfer(msg.sender, transferAmount);
			_amount -= transferAmount;
		}

		/// @notice Stakes SOV tokens in the user's behalf.
		SOV.approve(address(staking), _amount);

		staking.stakesBySchedule(_amount, FOUR_WEEKS, YEAR, FOUR_WEEKS, msg.sender, msg.sender);

		emit Burn(msg.sender, _amount);
	}

	/**
	 * @notice Overrides default ApprovalReceiver._getToken function to
	 * register SOV token on this contract.
	 * */
	function _getToken() internal view returns (address) {
		return address(SOV);
	}

	/**
	 * @notice Overrides default ApprovalReceiver._getSelectors function to
	 * register mintWithApproval selector on this contract.
	 * */
	function _getSelectors() internal view returns (bytes4[] memory) {
		bytes4[] memory selectors = new bytes4[](1);
		selectors[0] = this.mintWithApproval.selector;
		return selectors;
	}
}
