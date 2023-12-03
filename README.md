# uau.li

Uau is a temparory/permanent link shortener.

**[Have a try!](https://two.li)**\*

\* currently deployed on [Workers](https://workers.cloudflare.com/), [Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv) & [Pages](https://pages.cloudflare.com/)

## Usage

* Generate a temporary shortened link for a link
* ... or for some text
* Generate permanent links for the administrator

## Special Traits

### Multiple levels of paths

Examples:

* GitHub Action docs: [two.li/gha/docs](https://two.li/gha/docs)
* GitHub Action environments: [two.li/gha/env](https://two.li/gha/env)
* GitHub Action script: [two.li/gha/script](https://two.li/gha/script)

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
| [two.li/pixiv/15308432](https://two.li/pixiv/15308432) | https://www.pixiv.net/en/artworks/15308432 |
| [two.li/pixiv/93067044](https://two.li/pixiv/93067044) | https://www.pixiv.net/en/artworks/93067044 |
| two.li/pixiv/\<any id\>                                | https://www.pixiv.net/en/artworks/<id\>    |

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

| UAU link                                               | Target                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [two.li/1p3a?tid=4428](https://two.li/1p3a?tid=4428)   | https://www.1point3acres.com/bbs/forum.php?mod=viewthread&tid=4428  |
| [two.li/1p3a?tid=71069](https://two.li/1p3a?tid=71069) | https://www.1point3acres.com/bbs/forum.php?mod=viewthread&tid=71069 |
| two.li/1p3a?tid=\<any id\>                             | https://www.1point3acres.com/bbs/forum.php?mod=viewthread&tid=<id\> |

### Use [any database](/core/src/interface.ts#L24-L28) on your choice

e.g. [Workers KV](/publish/workers/src/interface.ts#L7-L33)

## Core API & Other Features

Check [API doc](/core).

## [Frontends](/publish)

* [static](/public/static) - The we page
* [workers](/public/workers) - The API implementation on [Workers](https://workers.cloudflare.com/)

## License

MIT
