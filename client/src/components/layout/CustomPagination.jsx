import React from "react";
import Pagination from "react-bootstrap/Pagination";

const CustomPagination = ({ pages, activePage, onPageChange }) => {
	const showEllipsis = pages.length >= 9;

	let renderedPages = [];

	if (pages.length <= 8) {
		renderedPages = pages;
	} else {
		if (activePage <= 5) {
			renderedPages.push(1, 2, 3, 4, 5, "ellipsis", pages.length - 1, pages.length);
		} else if (activePage > pages.length - 5) {
			renderedPages.push(
				1,
				2,
				"ellipsis",
				pages.length - 4,
				pages.length - 3,
				pages.length - 2,
				pages.length - 1,
				pages.length
			);
		} else {
			renderedPages.push(1, "ellipsis-start", activePage - 1, activePage, activePage + 1, "ellipsis-end", pages.length);
		}
	}

	return (
		<Pagination className="justify-content-center custom-pagination pt-2 mt-2">
			<Pagination.First onClick={() => onPageChange(1)} />
			<Pagination.Prev onClick={() => onPageChange(activePage - 1)} />

			{renderedPages.map((page, index) => (
				<React.Fragment key={index}>
					{page === "ellipsis" && showEllipsis && <Pagination.Ellipsis />}
					{page === "ellipsis-start" && showEllipsis && <Pagination.Ellipsis />}
					{page === "ellipsis-end" && showEllipsis && <Pagination.Ellipsis />}
					{typeof page === "number" && (
						<Pagination.Item onClick={() => onPageChange(page)} active={activePage === page}>
							{page}
						</Pagination.Item>
					)}
				</React.Fragment>
			))}

			<Pagination.Next onClick={() => onPageChange(activePage + 1)} />
			<Pagination.Last onClick={() => onPageChange(pages.length)} />
		</Pagination>
	);
};

export default CustomPagination;

// const CustomPagination = ({ projects, pages, activePage, onPageChange }) => {
// 	console.log("projects", projects.length);
// 	return (
// 		<>
// 			{Math.ceil(projects.length / 10) > 1 && (
// 				<div>
// 					<ReactPaginate
// 						className="d-flex text-white"
// 						previousLabel={"<"}
// 						nextLabel={">"}
// 						breakLabel={"..."}
// 						breakClassName=""
// 						containerClassName=""
// 						pageClassName="px-2"
// 						pageCount={Math.ceil(projects.length / 10)}
// 						marginPagesDisplayed={2}
// 						pageRangeDisplayed={3}
// 						onPageChange={onPageChange}
// 						activeClassName=""
// 						activeLinkClassName=""
// 						previousClassName=""
// 						nextClassName=""
// 						disabledClassName=""
// 					/>
// 				</div>
// 			)}
// 		</>
// 	);
// };

// export default CustomPagination;
