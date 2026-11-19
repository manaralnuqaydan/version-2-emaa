| Model | Top-1 | Top-5 | Precision | Recall | Macro F1 | Latency (ms) | Size (MB) | Train (min) |
|---|---|---|---|---|---|---|---|---|
| Holistic landmarks + 1D-CNN (ours) | 85.5% | 96.9% | 86.1% | 85.4% | 85.2% | 5.6 | 2.9 | 2.5 |
| BiGRU (sequence) | 77.1% | 94.0% | 78.1% | 77.1% | 76.9% | 9.0 | 2.2 | 2.8 |
| Random Forest | 67.8% | 89.9% | 70.0% | 67.6% | 67.5% | 110.7 | 823.6 | 0.2 |
| Logistic Regression | 67.1% | 89.5% | 72.6% | 67.0% | 67.9% | 3.5 | 0.4 | 0.6 |
| SVM (RBF) | 62.2% | 87.1% | 67.1% | 62.0% | 62.4% | 5.4 | 25.1 | 0.3 |
| k-NN (k=5) | 47.7% | 73.9% | 52.8% | 47.5% | 47.4% | 5.5 | 11.4 | 0.0 |

ASL Citizen subset: 100 signs, official signer-independent split, 1290 test videos from 11 unseen signers.
