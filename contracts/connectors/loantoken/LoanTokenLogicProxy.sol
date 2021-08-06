pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./AdvancedTokenStorage.sol";

/**
 * @title Loan Token Logic Proxy contract.
 *
 * @notice This contract contains the proxy functionality and it will query the logic target from LoanTokenLogicBeacon
 * This contract will also has the pause/unpause functionality. The purpose of this pausability is so that we can pause/unpause from the loan token level.
 *
 */
contract LoanTokenLogicProxy is AdvancedTokenStorage {
	/**
	 * @notice PLEASE DO NOT ADD ANY VARIABLES HERE UNLESS FOR SPESIFIC SLOT
	 */

	/// ------------- MUST BE THE SAME AS IN LoanToken CONTRACT -------------------
	address public sovrynContractAddress;
	address public wrbtcTokenAddress;
	address public target_;
	address public admin;
	/// ------------- END MUST BE THE SAME AS IN LoanToken CONTRACT -------------------

	/**
	 * @notice PLEASE DO NOT ADD ANY VARIABLES HERE UNLESS FOR SPESIFIC SLOT
	 */

	bytes32 internal constant LOAN_TOKEN_LOGIC_BEACON_ADDRESS_SLOT = 0xd918085b6ac26c71bca17b569f873038d2b9c0a3a62611d7037f46a40829de6a; // keccak256("LOAN_TOKEN_LOGIC_BEACON_ADDRESS_SLOT")

	modifier onlyProxyAdmin() {
		require(msg.sender == admin, "LoanTokenLogicProxy:unauthorized");
		_;
	}

	constructor(address _beaconAddress) public {
		// Initialize the LoanTokenLogicBeacon address
		_setBeaconAddress(_beaconAddress);
	}

	/**
	 * @notice Fallback function performs a logic implementation address query to LoanTokenLogicBeacon and then do delegate call to that query result address.
	 * Returns whatever the implementation call returns.
	 * */
	function() external payable {
		if (gasleft() <= 2300) {
			return;
		}

		address target = LoanTokenLogicBeacon(_beaconAddress()).getTarget(msg.sig);
		// query the logic target implementation address from the LoanTokenLogicBeacon
		require(target != address(0), "LoanTokenProxy:target not active");

		bytes memory data = msg.data;
		assembly {
			let result := delegatecall(gas, target, add(data, 0x20), mload(data), 0, 0)
			let size := returndatasize
			let ptr := mload(0x40)
			returndatacopy(ptr, 0, size)
			switch result
				case 0 {
					revert(ptr, size)
				}
				default {
					return(ptr, size)
				}
		}
	}

	/**
	 * @dev Returns the current Loan Token logic Beacon.
	 * @return Address of the current LoanTokenLogicBeacon.
	 */
	function _beaconAddress() internal view returns (address beaconAddress) {
		bytes32 slot = LOAN_TOKEN_LOGIC_BEACON_ADDRESS_SLOT;
		assembly {
			beaconAddress := sload(slot)
		}
	}

	/**
	 * @return The address of the current LoanTokenLogicBeacon.
	 */
	function beaconAddress() external view returns (address) {
		return _beaconAddress();
	}

	/**
	 * @dev Set/update the new beacon address.
	 * @param _newBeaconAddress Address of the new LoanTokenLogicBeacon.
	 */
	function _setBeaconAddress(address _newBeaconAddress) private {
		require(Address.isContract(_newBeaconAddress), "Cannot set beacon address to a non-contract address");

		bytes32 slot = LOAN_TOKEN_LOGIC_BEACON_ADDRESS_SLOT;

		assembly {
			sstore(slot, _newBeaconAddress)
		}
	}

	/**
	 * @dev External function to set the new LoanTokenLogicBeacon Address
	 * @param _newBeaconAddress Address of the new LoanTokenLogicBeacon
	 */
	function setBeaconAddress(address _newBeaconAddress) external onlyProxyAdmin {
		_setBeaconAddress(_newBeaconAddress);
	}
}

interface LoanTokenLogicBeacon {
	function getTarget(bytes4 functionSignature) external view returns (address logicTargetAddress);
}
