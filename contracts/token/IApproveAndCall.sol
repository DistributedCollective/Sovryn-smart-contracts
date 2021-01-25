pragma solidity ^0.5.17;

interface IApproveAndCall {

    function receiveApproval(address _sender, uint256 _amount, address _token, bytes calldata _data) external;

}