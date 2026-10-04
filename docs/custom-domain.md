# Connect pf-sf-infographics.top to GitHub Pages

Checked 2026-10-04: the repository uses an Actions deployment and has no custom domain yet. The domain uses
Namecheap DNS; its apex resolves to Namecheap parking/redirect address `162.255.119.200`, and `www` points to
`parkingpage.namecheap.com`. The following steps replace those parking records with GitHub Pages hosting.

1. In your **GitHub account Settings → Pages**, add and verify `pf-sf-infographics.top`. GitHub supplies a TXT
   record; add that exact host/value in Namecheap and complete verification. Keep the TXT record afterward.
2. Open [this repository’s Pages settings](https://github.com/allquixotic/pf-sf-infographics/settings/pages).
   Set **Custom domain** to `pf-sf-infographics.top` and save. Coordinate this step with the DNS change below:
   GitHub starts redirecting the old address when the domain is configured, so there may be a propagation window.
3. In **Namecheap → Domain List → Manage → Advanced DNS → Host Records**, remove the existing parking or URL
   redirect records for `@` and `www`, and enter the following records. Use Automatic TTL. Leave unrelated mail,
   verification and other records intact.

| Type | Host | Value |
| --- | --- | --- |
| A Record | @ | 185.199.108.153 |
| A Record | @ | 185.199.109.153 |
| A Record | @ | 185.199.110.153 |
| A Record | @ | 185.199.111.153 |
| CNAME Record | www | allquixotic.github.io |

4. Re-run [Deploy to GitHub Pages](https://github.com/allquixotic/pf-sf-infographics/actions/workflows/pages.yml)
   using **Run workflow → main**, or run `gh workflow run pages.yml`. The workflow obtains the domain’s base path
   from GitHub, so assets are rebuilt for `/`. This Actions deployment does not use a committed `CNAME` file.
5. Once GitHub’s DNS check and certificate provisioning complete, enable **Enforce HTTPS** in Pages settings.
   DNS propagation and certificate availability can each take up to 24 hours. GitHub provides the certificate;
   no Namecheap hosting or paid SSL certificate is needed.

The resulting canonical address is `https://pf-sf-infographics.top/`. GitHub handles redirects from `www` and
from the old `https://allquixotic.github.io/pf-sf-infographics/` address. The CNAME target must contain neither
`https://` nor the repository path. Do not use Namecheap masked forwarding or wildcard records.

Optional IPv6: add four AAAA records at `@` with `2606:50c0:8000::153`, `2606:50c0:8001::153`,
`2606:50c0:8002::153`, and `2606:50c0:8003::153`, alongside the A records.

Verify with:

```sh
dig +short pf-sf-infographics.top A
dig +short www.pf-sf-infographics.top CNAME
curl -I https://pf-sf-infographics.top/
curl -I https://allquixotic.github.io/pf-sf-infographics/
```

Browser preferences and uploaded artwork are stored per origin. The new domain cannot read the old domain’s
storage; users will need to select their preferences and upload their archives again on the new address.

Sources: [GitHub’s custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site),
[Namecheap’s GitHub Pages instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/9645/2208/how-do-i-link-my-domain-to-github-pages/).
