#!/usr/bin/env python3
 
# Script to create report on bytecodes not supported by zkSync
# https://github.com/DistributedCollective/Sovryn-smart-contracts/issues/285

import json
import re
import csv

# Hardhat json packs opcodes in 1 line. Better visual on multiline.
def opcode1linerToMultiline(oneLiner):
    oneLiner = re.sub(r' ', r' ___NEWLINE ', oneLiner)
    oneLiner = re.sub(r' ___NEWLINE (0x[^ ]+)', r' \1', oneLiner)
    oneLiner = re.sub(r' ___NEWLINE ', r'\n', oneLiner)
    return oneLiner

# Get the frequency of a given code
def countCode(code, opcode):
    return opcode.count(code)

# The sourcemap format is compressed, so a decoder is needed.
# Specification of the format is in the solidity documentation:
# https://docs.soliditylang.org/en/v0.7.5/internals/source_mappings.html
# This function maps instruction indexes to source offsets.
# Deprecated: even though decoding were performed, there is not a
# one-to-one matching of sourcemap references to opcodes. For example,
# a simple contract has 21 references in the sourceMap (20 semicolons)
# for an opcode set of near 100 instructions. So it is useless to follow
# this route in order to trace opcodes to the source with code line accuracy.
# def decodeSourceMap(srcmap):
#     print ("decodeSourceMap:")
#     print ("\nsrcmap: " + srcmap)
#     s = srcmap.split(";")
#     print ("\nsplitted: " + ' '.join(s))
#     exit()

# Opening the JSON output from the last hardhat compilation
# f = open('artifacts/build-info/eaaf433b5af1a78be582155342f51ab5.json',)
f = open('artifacts/build-info/0202910f40424d4ba1f4d5c762daecf5.json',)

# Return JSON object as a dictionary
hardhatOutput = json.load(f)

# Init mapping to store global frequency
opcodeFreqTotal = {}
opcodeFreqTotal["EXP"] = 0
opcodeFreqTotal["ADDMOD"] = 0
opcodeFreqTotal["SMOD"] = 0
opcodeFreqTotal["MULMOD"] = 0
opcodeFreqTotal["CREATE2"] = 0
opcodeFreqTotal["SELFDESTRUCT"] = 0

# Init CSV list
csv_list = []
csv_list.append(["contractFilename", "EXP", "ADDMOD", "SMOD", "MULMOD", "CREATE2", "SELFDESTRUCT"])

# Iterate through the json list
for contractFilename in hardhatOutput['output']['contracts'].keys():
    print (contractFilename)
    contractName = list(hardhatOutput['output']['contracts'][contractFilename].keys())[0]
    opcodes = hardhatOutput['output']['contracts'][contractFilename][contractName]['evm']['bytecode']['opcodes']
    # Deprecated
    # srcmap = hardhatOutput['output']['contracts'][contractFilename][contractName]['evm']['bytecode']['sourceMap']
    # srcmapDecoded = decodeSourceMap(srcmap)
    if len(opcodes) == 0:
        print ("No opcodes for this contract\n")
    else:
        print (opcode1linerToMultiline(opcodes[0:120]) + " ...\n")

    # Mapping to store per contract frequency
    opcodeFreq = {}

    opcodeFreq["EXP"] = countCode("EXP", opcodes)
    opcodeFreq["ADDMOD"] = countCode("ADDMOD", opcodes)
    opcodeFreq["SMOD"] = countCode("SMOD", opcodes)
    opcodeFreq["MULMOD"] = countCode("MULMOD", opcodes)
    opcodeFreq["CREATE2"] = countCode("CREATE2", opcodes)
    opcodeFreq["SELFDESTRUCT"] = countCode("SELFDESTRUCT", opcodes)

    print ("EXP: " + str(opcodeFreq["EXP"]))
    print ("ADDMOD: " + str(opcodeFreq["ADDMOD"]))
    print ("SMOD: " + str(opcodeFreq["SMOD"]))
    print ("MULMOD: " + str(opcodeFreq["MULMOD"]))
    print ("CREATE2: " + str(opcodeFreq["CREATE2"]))
    print ("SELFDESTRUCT: " + str(opcodeFreq["SELFDESTRUCT"]))
    print ("")
    print ("--\n")
    
    # Update global frequencies
    opcodeFreqTotal["EXP"] += opcodeFreq["EXP"]
    opcodeFreqTotal["ADDMOD"] += opcodeFreq["ADDMOD"]
    opcodeFreqTotal["SMOD"] += opcodeFreq["SMOD"]
    opcodeFreqTotal["MULMOD"] += opcodeFreq["MULMOD"]
    opcodeFreqTotal["CREATE2"] += opcodeFreq["CREATE2"]
    opcodeFreqTotal["SELFDESTRUCT"] += opcodeFreq["SELFDESTRUCT"]

    # Update CSV data
    csv_list.append([contractFilename, opcodeFreq["EXP"], opcodeFreq["ADDMOD"], opcodeFreq["SMOD"], opcodeFreq["MULMOD"], opcodeFreq["CREATE2"], opcodeFreq["SELFDESTRUCT"]])

# Show global frequencies
print ("===========================================================")
print ("TOTAL FREQUENCIES:")
print ("EXP: " + str(opcodeFreqTotal["EXP"]))
print ("ADDMOD: " + str(opcodeFreqTotal["ADDMOD"]))
print ("SMOD: " + str(opcodeFreqTotal["SMOD"]))
print ("MULMOD: " + str(opcodeFreqTotal["MULMOD"]))
print ("CREATE2: " + str(opcodeFreqTotal["CREATE2"]))
print ("SELFDESTRUCT: " + str(opcodeFreqTotal["SELFDESTRUCT"]))

# Export CSV
with open('opcodes_zkSync.csv', 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerows(csv_list)

# Closing file
f.close()

