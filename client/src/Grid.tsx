export type GridBlock = {
	id: string;
	img: string;
}

export function Grid(props: { blocks: (GridBlock | null)[], width: number, height: number }) {
	return <table className="grid">
		{Array(props.height).fill(0).map((_, ii) => <tr key={ii}>
			{Array(props.width).fill(0).map((_, jj) => <td key={jj}>
				<div>
					{props.blocks[ii * props.height + jj] && <img src={props.blocks[ii * props.height + jj]?.img} />}
					{ii * jj}
				</div>
			</td>)}
		</tr>)}
	</table>
}