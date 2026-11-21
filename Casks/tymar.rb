cask "tymar" do
  arch arm: "aarch64"

  version "0.3.0"
  sha256 "18d0e0d08fd9da99ea6d9bd60a26642229aa3bf5a39d06df4e4b02956318e8af"

  url "https://github.com/tonmoydeb404/tymar/releases/download/v#{version}/Tymar_#{version}_#{arch}.dmg"
  name "Tymar"
  desc "Effortless time tracking for focused work."
  homepage "https://github.com/tonmoydeb404/tymar"

  depends_on macos: :big_sur
  depends_on arch: :arm64

  app "Tymar.app"

  # Unsigned/un-notarized build: strip the quarantine flag Gatekeeper adds on download.
  postflight do
    system_command "/usr/bin/xattr",
                    args: ["-cr", "#{appdir}/Tymar.app"]
  end

  zap trash: [
    "~/Library/Application Support/com.tonmoydeb.tymar",
    "~/Library/Caches/com.tonmoydeb.tymar",
    "~/Library/Preferences/com.tonmoydeb.tymar.plist",
    "~/Library/Saved Application State/com.tonmoydeb.tymar.savedState",
  ]
end
