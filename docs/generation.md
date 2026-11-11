# Generation

Unversioned saves use generator 1 and fixed 32-tile chunks. Its simplex elevation, river test, and tree-dependent rock selection are retained. New sessions use generator 2 and persist their chunk size (default 32). Version 2 has a continuous global sinusoidal river centerline and independently hashed rocks. Both use global coordinates and the four existing elevation presets. The water slider expresses relative coverage; increasing it raises sea level.

Version 2 is partial: moisture layers, lake classification and a separate immutable generated-chunk cache have not yet been implemented. Streaming currently renders a square radius of 1–3 chunks and disposes unloaded groups.
