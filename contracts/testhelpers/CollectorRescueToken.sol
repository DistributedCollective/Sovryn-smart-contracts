pragma solidity 0.5.17;
contract CollectorRescueToken {
    mapping(address => uint256) public balanceOf;
    bool public paused;
    bool public chargeFee;
    address public callback;
    bool public callbackSucceeded;
    function mint(address a, uint256 n) external {
        balanceOf[a] += n;
    }
    function setPaused(bool p) external {
        paused = p;
    }
    function setChargeFee(bool p) external {
        chargeFee = p;
    }
    function setCallback(address a) external {
        callback = a;
    }
    function transfer(address to, uint256 n) external returns (bool) {
        require(!paused, "paused");
        require(balanceOf[msg.sender] >= n, "balance");
        balanceOf[msg.sender] -= n;
        balanceOf[to] += chargeFee && n > 0 ? n - 1 : n;
        if (callback != address(0)) {
            (bool success, ) = callback.call(abi.encodeWithSignature("rescueNative()"));
            callbackSucceeded = success;
        }
        return true;
    }
}
