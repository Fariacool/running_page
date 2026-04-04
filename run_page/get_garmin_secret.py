import argparse
import sys

import garth
import httpx

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("email", nargs="?", help="email of garmin")
    parser.add_argument("password", nargs="?", help="password of garmin")
    parser.add_argument(
        "--is-cn",
        dest="is_cn",
        action="store_true",
        help="if garmin account is cn",
    )
    parser.add_argument(
        "--api-url",
        dest="api_url",
        help="Garmin auth API URL",
    )
    parser.add_argument(
        "--api-token",
        dest="api_token",
        help="Bearer token for garmin auth API",
    )
    options = parser.parse_args()

    if not options.email or not options.password:
        print("Missing email or password")
        sys.exit(1)

    api_url = options.api_url
    api_token = options.api_token
    domain = "garmin.cn" if options.is_cn else "garmin.com"

    # Try API-based auth first (bypasses Cloudflare JS Challenge)
    if api_token and api_url:
        try:
            response = httpx.post(
                f"{api_url.rstrip('/')}/auth",
                json={
                    "email": options.email,
                    "password": options.password,
                    "domain": domain,
                },
                headers={"Authorization": f"Bearer {api_token}"},
                timeout=300.0,
            )
            if response.status_code == 200:
                data = response.json()
                print(data["secret_string"])
                sys.exit(0)
            else:
                print(
                    f"Auth API failed: {response.status_code} {response.text}, "
                    "falling back to garth"
                )
        except Exception as e:
            print(f"Auth API error: {e}, falling back to garth")

    # Fallback to garth
    if options.is_cn:
        garth.configure(domain="garmin.cn", ssl_verify=False)
    garth.login(options.email, options.password)
    secret_string = garth.client.dumps()
    print(secret_string)
