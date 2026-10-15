"""Metadata-only policy for root-managed, read-only nonroot secret mounts."""
import stat


def protected_secret_metadata(file_info, directory_info):
    """Pinned runtime UID/GID 65532; never reads or returns secret contents."""
    directory_mode = stat.S_IMODE(directory_info.st_mode)
    directory_safe = (
        stat.S_ISDIR(directory_info.st_mode)
        and directory_info.st_uid == 0
        and (
            directory_mode == 0o700
            or (directory_mode == 0o750 and directory_info.st_gid == 65532)
        )
    )
    return (
        directory_safe
        and stat.S_ISREG(file_info.st_mode)
        and file_info.st_uid == 0
        and file_info.st_gid == 65532
        and stat.S_IMODE(file_info.st_mode) in (0o440, 0o640)
    )
