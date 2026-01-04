"""
Encryption module using Fernet (AES-256-GCM) for API key storage
"""
from cryptography.fernet import Fernet
from app.config import get_settings

settings = get_settings()


def get_cipher() -> Fernet:
    """
    Get Fernet cipher instance using encryption key from settings

    Returns:
        Fernet cipher instance
    """
    encryption_key = settings.ENCRYPTION_KEY.encode() if isinstance(settings.ENCRYPTION_KEY, str) else settings.ENCRYPTION_KEY
    return Fernet(encryption_key)


def encrypt_value(plain_text: str) -> str:
    """
    Encrypt a plain text value using Fernet

    Args:
        plain_text: Plain text string to encrypt

    Returns:
        Base64-encoded encrypted string

    Example:
        >>> encrypted = encrypt_value("my-api-key-123")
        >>> print(encrypted)
        'gAAAAA...'
    """
    cipher = get_cipher()
    plain_bytes = plain_text.encode('utf-8')
    encrypted_bytes = cipher.encrypt(plain_bytes)
    return encrypted_bytes.decode('utf-8')


def decrypt_value(encrypted_text: str) -> str:
    """
    Decrypt an encrypted value using Fernet

    Args:
        encrypted_text: Base64-encoded encrypted string

    Returns:
        Decrypted plain text string

    Raises:
        cryptography.fernet.InvalidToken: If decryption fails (wrong key or corrupted data)

    Example:
        >>> decrypted = decrypt_value('gAAAAA...')
        >>> print(decrypted)
        'my-api-key-123'
    """
    cipher = get_cipher()
    encrypted_bytes = encrypted_text.encode('utf-8')
    decrypted_bytes = cipher.decrypt(encrypted_bytes)
    return decrypted_bytes.decode('utf-8')


def generate_encryption_key() -> str:
    """
    Generate a new Fernet encryption key

    Returns:
        Base64-encoded Fernet key

    Example:
        >>> key = generate_encryption_key()
        >>> print(key)
        'XyZ123...'

    Note:
        Run this once to generate a key for your .env file:
        python -c "from app.database.encryption import generate_encryption_key; print(generate_encryption_key())"
    """
    return Fernet.generate_key().decode('utf-8')


if __name__ == "__main__":
    # Generate a new encryption key
    print("Generated Fernet encryption key:")
    print(generate_encryption_key())
    print("\nAdd this to your .env file as ENCRYPTION_KEY")
