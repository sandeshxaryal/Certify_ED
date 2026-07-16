// src/controllers/blockchain.controller.js

/* 
blockchain.controller.js
  getBlockchainCertificate
  verifyCertificateById
  generateBlockchainRecord
  getBlockchainTransaction
  checkRevocationStatus

*/

import { getContract } from '../utils/blockchain.js';

export const getBlockchainCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const contract = getContract();

    // Call smart contract directly
    const result = await contract.methods
      .getCertificateDetails(certificateId)
      .call();

    // Format blockchain response
    const certificate = {
      certificateId,
      uid: result[0],
      candidateName: result[1],
      courseName: result[2],
      orgName: result[3],
      ipfsHash: result[4],
      timestamp: new Date(result[5] * 1000),
      revoked: result[6],
      source: 'blockchain'
    };

    res.json(certificate);

  } catch (error) {
    res.status(404).json({
      code: 'BLOCKCHAIN_CERTIFICATE_NOT_FOUND',
      message: 'Certificate not found on blockchain'
    });
  }
};


// under construction
// for the button  ViewOnBlockchain