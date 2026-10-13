export const HCC_DATASET_ID = 'SYNTHETIC_HONG_GILDONG_56_CT_20261010_V1';
export const HCC_MANIFEST_SHA256 = 'ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721';
export const HCC_STUDY_UID = '2.25.259656708708993797343330994179169711072';
export const HCC_SERIES_UID = '2.25.18361638789025095699746776899955737977';
export const HCC_SOURCE_PATHS = ['/gateway/hcc-source/challenge', '/gateway/hcc-source/report'];
export const HCC_INVENTORY_SHA256 = 'a2c4087efcad2f5594a54dd7c3f3563204e81b30f3d7afe45322a454d28b2207';
export const HCC_SOURCE_CONTRACT = Object.freeze({ datasetId: HCC_DATASET_ID, manifestSha256: HCC_MANIFEST_SHA256,
  studyUid: HCC_STUDY_UID, seriesUid: HCC_SERIES_UID, instanceCount: 700, totalBytes: 2202766342,
  inventorySha256: HCC_INVENTORY_SHA256, verification: 'MTLS_PACS_RAW_DICOM_SHA256_ALL', clinicalUse: false });
