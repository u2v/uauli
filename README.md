# uau.li

Uau is a temparory/permanent link shortener.

**[Have a try!](https://uau.li)**\*

\* currently deployed on [Workers](https://workers.cloudflare.com/), [Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv) & [Pages](https://pages.cloudflare.com/)

## Usage

* Generate a temporary shortened link for a link
* ... or for some text
* Generate permanent links for the administrator

## Special Traits

### Multiple levels of paths

Examples:

* GitHub Action docs: [uau.li/gha/docs](https://uau.li/gha/docs)
* GitHub Action environments: [uau.li/gha/env](https://uau.li/gha/env)
* GitHub Action script: [uau.li/gha/script](https://uau.li/gha/script)

### `inheritPath` - Append the paths after shortened link to the target URL

``` jsonc
// PUT /_/pixiv

{
    "type": "link",
    "payload": "https://www.pixiv.net/artworks",
    "inheritPath": true
}
```

Result:

| UAU link                                               | Target                                     |
| ------------------------------------------------------ | ------------------------------------------ |
| [uau.li/pixiv/15308432](https://uau.li/pixiv/15308432) | https://www.pixiv.net/en/artworks/15308432 |
| [uau.li/pixiv/93067044](https://uau.li/pixiv/93067044) | https://www.pixiv.net/en/artworks/93067044 |
| uau.li/pixiv/\<any id\>                                | https://www.pixiv.net/en/artworks/<id\>   |

### `inheritParam` - Append the query parameters to the target URL (and preserve the ones in the target URL)

``` jsonc
// PUT /_/1p3a

{
    "type": "link",
    "payload": "https://www.1point3acres.com/bbs/forum.php?mod=viewthread",
    "inheritParam": true
}
```

Result:

| UAU link                                               | Target                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| [uau.li/1p3a?tid=4428](https://uau.li/1p3a?tid=4428)   | https://www.1point3acres.com/bbs/forum.php?mod=viewthread&tid=4428   |
| [uau.li/1p3a?tid=71069](https://uau.li/1p3a?tid=71069) | https://www.1point3acres.com/bbs/forum.php?mod=viewthread&tid=71069  |
| uau.li/1p3a?tid=\<any id\>                             | https://www.1point3acres.com/bbs/forum.php?mod=viewthread&tid=<id\> |

### Use [any database](/core/src/interface.ts#L24-L28) on your choice

e.g. [Workers KV](/publish/workers/src/interface.ts#L7-L33)

## Core API & Other Features

Check [API doc](/core).

## [Frontends](/publish)

* [static](/public/static) - The we page
* [workers](/public/workers) - The API implementation on [Workers](https://workers.cloudflare.com/)

## License

MIT
