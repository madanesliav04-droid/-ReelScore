"""One-time public model download during explicit local setup, never at render time."""
import sys
from pathlib import Path
from huggingface_hub import snapshot_download

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/download-local-model.py DOSSIER_PRIVE')
    target = Path(sys.argv[1]).resolve()
    target.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id='Systran/faster-whisper-small',
        local_dir=str(target),
        allow_patterns=['model.bin', 'config.json', 'tokenizer.json',
                        'vocabulary.*', 'preprocessor_config.json'],
    )
    for name in ('model.bin', 'config.json', 'tokenizer.json'):
        if not (target / name).is_file():
            raise SystemExit('Modele incomplet : ' + name)
    print('Modele local disponible. Aucun service de transcription payant utilise.')
