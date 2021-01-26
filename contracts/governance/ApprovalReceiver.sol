pragma solidity ^0.5.17;

import "./ErrorDecoder.sol";
import "../token/IApproveAndCall.sol";

contract ApprovalReceiver is ErrorDecoder, IApproveAndCall {

    function receiveApproval(
        address _sender,
        uint256 _amount,
        address _token,
        bytes memory _data
    ) public {
        _receiveApproval(_sender, _amount, _getToken(), _data, _getSelectors());
    }

    function _getToken() internal returns (address) {
        return address(0);
    }

    function _getSelectors() internal returns (bytes4[] memory) {
        bytes4[] memory selectors = new bytes4[](1);
        return selectors;
    }

    function _receiveApproval(
        address _sender,
        uint256 _amount,
        address _token,
        bytes memory _data,
        bytes4[] memory _selectors
    ) internal {
        //accepts calls only from SOV token
        require(msg.sender == address(_token), "unauthorized");

        //only allowed methods
        bool isAllowed = false;
        bytes4 sig = _getSig(_data);
        for (uint i = 0; i < _selectors.length; i++) {
            if (sig == _selectors[i]) {
                isAllowed = true;
                break;
            }
        }
        require(isAllowed, "method is not allowed");

        (bool success, bytes memory returnData) = address(this).call(_data);
        if (!success) {
            if (returnData.length <= ERROR_MESSAGE_SHIFT) {
                revert("receiveApproval: Transaction execution reverted.");
            } else {
                revert(_addErrorMessage("receiveApproval: ", string(returnData)));
            }
        }
    }

    function _getSig(bytes memory _data) internal pure returns (bytes4 sig) {
        assembly {
            sig := mload(add(_data, 32))
        }
    }

}