## UAU Core

UAU is an extensive URL shortener.

### Options for All Uaus

| Option   | Description                                   | Comments           |
| -------- | --------------------------------------------- | ------------------ |
| validity | The time (in seconds) before the link expires | 0 = never expire   |
| override | Override exiting links.                       | Need admin access. |

### Options per Uau type

#### Basic Uau (`UauWithLink`)

```
uau.li/t -> example.com/li/nk
```

| Option       | Description                                            | Comments                                                                                                                             |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| payload      | The payload saved with the slug                        |                                                                                                                                      |
| inheritPath  | Add the subpath when redirecting to the original URL   | <ul><li> If `true`: `uau.li/t/12/34` -> `example.com/li/nk/12/34` </li><li> If `false`: `uau.li/t/12/34` -> Not found </li></ul>     |
| inheritParam | Add the parameter when redirecting to the original URL | <ul><li> If `true`: `uau.li/t?p=1` -> `example.com/li/nk?p=1` </li><li> If `false`: `uau.li/t?p=1` -> `example.com/li/nk` </li></ul> |


#### Uau with payload (`UauWithPayload`)

```
uau.li/t -> "Some text"
```

| Option      | Description                         | Comments |
| ----------- | ----------------------------------- | -------- |
| payload     | The payload saved with the slug     |          |
| contentType | The Content-Type header of the text |          |