import React from "react";

export default function Scraper() {
	return (
		<div className="scraper-page">
			<div className="watch-input position-relative mb-3">
				<input type="text" placeholder="Search Channels" />
				<button className="btnGradient h-50 w-202 br-30">Search</button>
			</div>
			<div className="gradient-box mb-4">
				<div className="fs-26 fw-700 text-white mb-4">MadApes</div>
				<div className="gradient-box">
					<div className="table-responsive">
						<table className="table table-borderless">
							<thead>
								<tr>
									<th className="fs-14 fw-700 text-white">Channel Name</th>
									<th className="fs-14 fw-700 text-white" style={{ width: "600px" }}>
										BIO
									</th>
									<th className="fs-14 fw-700 text-white">Members</th>
									<th className="fs-14 fw-700 text-white"></th>
									<th className="fs-14 fw-700 text-white"></th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td className="fs-14 fw-400 text-grey">MadApes Calls</td>
									<td className="fs-14 fw-400 text-grey">
										<div>5Eth, ARB, BSC, Bonerium, Zksync ... everything Owner: @theT1T4N Lounge:</div>
										<div>@mad_apes Gambles: @mad_apes_gambles </div>
										<div>Twitter: https://www.twitter.com/madapescall</div>
									</td>
									<td className="fs-14 fw-400 text-grey">29,093</td>
									<td className="fs-14 fw-400 text-grey">
										{" "}
										<label className="CheckBox d-flex align-items-center gap-3">
											<input type="checkbox" />
											<span className="checkmark"></span>
										</label>
									</td>
									<td className="fs-24 fw-400 text-white line-1">
										<span className="iconify" data-icon="ic:baseline-settings"></span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div className="gradient-box mb-4">
				<div className="fs-26 fw-700 text-white mb-4">Kingdom</div>
				<div className="gradient-box">
					<div className="table-responsive">
						<table className="table table-borderless ">
							<thead>
								<tr>
									<th className="fs-14 fw-700 text-white">Channel Name</th>
									<th className="fs-14 fw-700 text-white" style={{ width: "600px" }}>
										BIO
									</th>
									<th className="fs-14 fw-700 text-white">Members</th>
									<th className="fs-14 fw-700 text-white"></th>
									<th className="fs-14 fw-700 text-white"></th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td className="fs-14 fw-400 text-grey">Kingdom of X100 Calls</td>
									<td className="fs-14 fw-400 text-grey">
										<div>Be the Future Billionaire Twitter: https://twitter.com/juliane_1990_ </div>
										<div>
											<span className="fw-700">Queen:</span> @Ju_X100{" "}
										</div>
										<div>
											<span className="fw-700">Prince:</span> @gibamachado{" "}
										</div>
										<div className="mb-2">
											<span className="fw-700">Calls Recap:</span> https://t.me/Kingdom_X100_CALLS/2075
										</div>
										<div>We are NOT Financial Advisors. We only share projects we like and see potential to grrow</div>
									</td>
									<td className="fs-14 fw-400 text-grey">29,093</td>
									<td className="fs-14 fw-400 text-grey">
										{" "}
										<label className="CheckBox d-flex align-items-center gap-3">
											<input type="checkbox" />
											<span className="checkmark"></span>
										</label>
									</td>
									<td className="fs-24 fw-400 text-white line-1">
										<span className="iconify" data-icon="ic:baseline-settings"></span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div className="d-flex align-items-center gap-4">
				<button type="button" className="btnLightGradient br-30 w-202 h-50">
					Add to Feed
				</button>
				<button type="button" className="btnGradient br-30 w-202 h-50">
					Add to Watchlist
				</button>
			</div>
		</div>
	);
}
