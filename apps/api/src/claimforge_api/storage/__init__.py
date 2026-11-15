"""Where uploaded files live: one interface over local disk and S3-compatible storage.

Features store bytes under an object key and hand clients short-lived signed URLs, so
large uploads and downloads go straight to storage instead of through API handlers.
"""
