//SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {MockV3Aggregator as ChainlinkMockV3Aggregator} from "@chainlink/contracts/src/v0.8/shared/mocks/MockV3Aggregator.sol";

contract MockV3Aggregator is ChainlinkMockV3Aggregator {
    constructor(uint8 decimal, int256 answer) 
        ChainlinkMockV3Aggregator(decimal, answer)
    {}
}