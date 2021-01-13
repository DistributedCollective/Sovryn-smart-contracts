pragma solidity 0.5.17;

// SPDX-License-Identifier:MIT
contract VerifySignature {
    function getMessageHash(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount,
        bytes4 methodSig
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(loanId, receiver, depositAmount, methodSig)
            );
    }

    function getEthSignedMessagehash(bytes32 messageHash)
        internal
        pure
        returns (bytes32)
    {
        return (
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    messageHash
                )
            )
        );
    }

    function verify(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount,
        bytes4 methodSig,
        bytes memory sig
    ) public pure returns (bool) {
        bytes32 messageHash =
            getMessageHash(loanId, receiver, depositAmount, methodSig);
        bytes32 ethSignedMessageHash = getEthSignedMessagehash(messageHash);
        return receiver == address(recoverSigner(ethSignedMessageHash, sig));
    }

    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory sig)
        internal
        pure
        returns (address)
    {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(sig);
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(sig.length == 65, "invalid signature length");
        assembly {
            r := mload(add(sig, 32)) //add(sig,32) ==> Skips first 32 bytes . mload(something)=> load next 32bytes starting at memory address something
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
