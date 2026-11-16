"""Files clients upload straight to storage: what every kind of claim file shares.

The flow is the same for photos and documents: record a pending upload and sign a link for
it, let the client send the file, then check the stored file before the real record exists.
"""
