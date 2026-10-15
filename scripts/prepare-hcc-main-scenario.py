"""Create a distinct synthetic 56-year-old presentation Study; preserve source pixels."""
import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
import pydicom
from generate_synthetic_hcc_ct import canonical_manifest_sha256, deterministic_uid, validate_dataset

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'artifacts/synthetic-hcc-ct/full-seed-20261010'
TARGET = ROOT / 'artifacts/synthetic-hcc-ct/hong-gildong-56-20261010'


def write_candidate_notes(target, uid_revision, source_manifest_sha256):
    (target / 'scenario.md').write_text(
        '# Hong Gil-dong presentation fixture\n\n'
        '**SYNTHETIC / TEST DATA / NOT FOR CLINICAL USE.**\n\n'
        '- Display identity: 홍길동 (합성 환자), age 56.\n'
        '- The displayed scenario is fictional; this is not a scan acquired from a person and does not represent a diagnosis.\n'
        '- Four CT phase series, 180 slices per series, 512 × 512 pixels per slice.\n'
        '- Pixel data is inherited from the synthetic procedural quality candidate; only synthetic scenario metadata and DICOM UIDs are transformed.\n'
        '- Source manifest SHA-256: `' + source_manifest_sha256 + '`\n'
        '- Separate DICOM UID namespace revision: `' + uid_revision + '`\n'
        '- Review: `DRAFT / UNASSIGNED`\n', encoding='utf-8')
    (target / 'quality-notes.md').write_text(
        '# CT visual quality candidate v2\n\n'
        '**SYNTHETIC / NOT FOR CLINICAL USE.** This candidate is a procedurally generated display and integration fixture, not acquired clinical imaging.\n\n'
        '- Improved tissue-specific texture and noise, continuous across slices and shared consistently across phases.\n'
        '- Added synthetic renal internal regions, pancreas/gallbladder landmarks, finer vessel branches, and a broader rib pattern.\n'
        '- Existing dataset retained; this candidate uses a separate UID namespace and is not registered or deployed automatically.\n'
        '- Pixel and metadata integrity are checked against the source manifest.\n'
        '- Visual resemblance does not establish anatomical accuracy, diagnostic validity, or clinical suitability.\n\n'
        'Review: `DRAFT / UNASSIGNED`\n', encoding='utf-8')


def prepare(source=SOURCE, target=TARGET, uid_revision='20261010'):
    source = Path(source).expanduser().resolve()
    target = Path(target).expanduser().resolve()
    if not re.fullmatch(r'[A-Za-z0-9._-]{1,48}', uid_revision):
        raise ValueError('SCENARIO_REVISION_INVALID')
    if source == target or source in target.parents:
        raise ValueError('SCENARIO_PATH_INVALID')
    if target.exists():
        result = validate_dataset(target, verify_pixel_data=True)
        manifest = json.loads((target / 'manifest.json').read_text(encoding='utf-8'))
        if (manifest.get('presentationScenario') != 'HONG_GILDONG_SYNTHETIC_56'
                or manifest.get('patientAgeYears') != 56
                or manifest.get('scenarioRevision') != uid_revision):
            raise ValueError('SCENARIO_TARGET_COLLISION')
        original = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
        if manifest.get('pixelSourceManifestSha256') != original['canonicalManifestSha256']:
            raise ValueError('SCENARIO_PIXEL_SOURCE_MISMATCH')
        for series in manifest['series']:
            for instance in series['instances']:
                source_file = (source / instance['file']).resolve()
                target_file = (target / instance['file']).resolve()
                if not source_file.is_relative_to(source) or not target_file.is_relative_to(target):
                    raise ValueError('SCENARIO_PATH_INVALID')
                ds = pydicom.dcmread(target_file)
                if ds.PatientAge != '056Y' or ds.PixelData != pydicom.dcmread(source_file).PixelData:
                    raise ValueError('SCENARIO_PIXEL_OR_AGE_MISMATCH')
        write_candidate_notes(target, uid_revision, original['canonicalManifestSha256'])
        return result
    validate_dataset(source, verify_pixel_data=True)
    manifest = copy.deepcopy(json.loads((source / 'manifest.json').read_text(encoding='utf-8')))
    uid_namespace = f'highpass:hong-gildong-56:{uid_revision}:'
    manifest['studyInstanceUID'] = deterministic_uid(uid_namespace + 'study')
    manifest['frameOfReferenceUID'] = deterministic_uid(uid_namespace + 'frame')
    manifest['presentationScenario'] = 'HONG_GILDONG_SYNTHETIC_56'
    manifest['presentationName'] = '홍길동 (합성 환자)'
    manifest['patientAgeYears'] = 56
    manifest['scenarioRevision'] = uid_revision
    manifest['pixelSourceManifestSha256'] = manifest['canonicalManifestSha256']
    manifest['generator'] += f'+presentation-56-{uid_revision}'
    manifest['review'] = 'DRAFT / UNASSIGNED'
    target.mkdir(parents=True)
    hashes = []
    for series in manifest['series']:
        series['seriesInstanceUID'] = deterministic_uid(uid_namespace + 'series:' + series['phase'])
        series['totalBytes'] = 0
        for instance in series['instances']:
            source_file = (source / instance['file']).resolve()
            target_file = (target / instance['file']).resolve()
            if not source_file.is_relative_to(source) or not target_file.is_relative_to(target):
                raise ValueError('SCENARIO_PATH_INVALID')
            ds = pydicom.dcmread(source_file)
            pixel_hash = hashlib.sha256(ds.PixelData).hexdigest()
            ds.PatientAge = '056Y'
            ds.StudyInstanceUID = manifest['studyInstanceUID']
            ds.FrameOfReferenceUID = manifest['frameOfReferenceUID']
            ds.SeriesInstanceUID = series['seriesInstanceUID']
            ds.SOPInstanceUID = deterministic_uid(uid_namespace + 'sop:' + instance['sopInstanceUID'])
            ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
            target_file.parent.mkdir(parents=True, exist_ok=True)
            ds.save_as(target_file, enforce_file_format=True)
            reread = pydicom.dcmread(target_file)
            if hashlib.sha256(reread.PixelData).hexdigest() != pixel_hash or reread.PatientAge != '056Y':
                raise ValueError('SCENARIO_PIXEL_OR_AGE_MISMATCH')
            instance.update(sopInstanceUID=str(ds.SOPInstanceUID), bytes=target_file.stat().st_size,
                            sha256=hashlib.sha256(target_file.read_bytes()).hexdigest())
            series['totalBytes'] += instance['bytes']
            hashes.append(instance['sha256'] + '  ' + instance['file'])
    manifest['totalDicomBytes'] = sum(s['totalBytes'] for s in manifest['series'])
    manifest['canonicalManifestSha256'] = canonical_manifest_sha256(manifest)
    (target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    (target / 'hashes.sha256').write_text('\n'.join(hashes) + '\n', encoding='utf-8')
    write_candidate_notes(target, uid_revision, manifest['pixelSourceManifestSha256'])
    return validate_dataset(target, verify_pixel_data=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output', type=Path, default=TARGET)
    parser.add_argument('--revision', default='20261010')
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.output, args.revision), ensure_ascii=False))
